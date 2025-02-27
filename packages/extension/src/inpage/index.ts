import {
  AddTransactionResponse,
  Provider,
  Signature,
  SignerInterface,
  Transaction,
  defaultProvider,
  typedData,
} from "starknet"

import { MessageType, WindowMessageType } from "../shared/MessageType"
import { EventHandler, StarknetWindowObject } from "./model"

const extId = document
  .getElementById("argent-x-extension")
  ?.getAttribute("data-extension-id")

const userEventHandlers: EventHandler[] = []

function sendMessage(msg: MessageType): void {
  return window.postMessage(
    { ...msg, extensionId: extId },
    window.location.origin,
  )
}

function waitForMsgOfType<
  K extends MessageType["type"],
  T extends { type: K } & MessageType,
>(
  type: K,
  timeout: number,
  predicate: (x: T) => boolean = () => true,
): Promise<T extends { data: any } ? T["data"] : undefined> {
  return new Promise((resolve, reject) => {
    const pid = setTimeout(() => reject("Timeout"), timeout)
    const handler = (event: MessageEvent<WindowMessageType>) => {
      if (event.data.type === type && predicate(event.data as any)) {
        clearTimeout(pid)
        window.removeEventListener("message", handler)
        return resolve(
          ("data" in event.data ? event.data.data : undefined) as any,
        )
      }
    }
    window.addEventListener("message", handler)
  })
}

// window.ethereum like
const starknetWindowObject: StarknetWindowObject = {
  signer: undefined,
  provider: defaultProvider,
  selectedAddress: undefined,
  isConnected: false,
  request: async (call) => {
    if (call.type === "wallet_watchAsset" && call.params.type === "ERC20") {
      sendMessage({
        type: "ADD_TOKEN",
        data: {
          address: call.params.options.address,
          symbol: call.params.options.symbol,
          decimals: call.params.options.decimals?.toString(),
          name: call.params.options.name,
        },
      })
      const { actionHash } = await waitForMsgOfType("ADD_TOKEN_RES", 1000)
      sendMessage({ type: "OPEN_UI" })

      const result = await Promise.race([
        waitForMsgOfType(
          "APPROVE_ADD_TOKEN",
          11 * 60 * 1000,
          (x) => x.data.actionHash === actionHash,
        ),
        waitForMsgOfType(
          "REJECT_ADD_TOKEN",
          10 * 60 * 1000,
          (x) => x.data.actionHash === actionHash,
        )
          .then(() => "error" as const)
          .catch(() => {
            sendMessage({ type: "FAILED_TX", data: { actionHash } })
            return "timeout" as const
          }),
      ])

      if (result === "error") throw Error("User abort")
      if (result === "timeout") throw Error("User action timed out")

      return
    }
    throw Error("Not implemented")
  },
  enable: () =>
    new Promise((resolve) => {
      const handleMessage = ({ data }: MessageEvent<WindowMessageType>) => {
        const { starknet } = window
        if (!starknet) {
          return
        }

        if (data.type === "CONNECT_RES" && data.data) {
          window.removeEventListener("message", handleMessage)
          const { address, network } = data.data
          starknet.provider = new Provider({ network: network as any })
          starknet.signer = new WalletSigner(address, starknet.provider)
          starknet.selectedAddress = address
          starknet.isConnected = true
          resolve([address])
        }
      }
      window.addEventListener("message", handleMessage)

      sendMessage({ type: "CONNECT", data: { host: window.location.host } })
    }),
  on: (event, handleEvent) => {
    if (event !== "accountsChanged") {
      throw new Error(`Unknwown event: ${event}`)
    }
    userEventHandlers.push(handleEvent)
  },
  off: (event, handleEvent) => {
    if (event !== "accountsChanged") {
      throw new Error(`Unknwown event: ${event}`)
    }
    if (userEventHandlers.includes(handleEvent)) {
      userEventHandlers.splice(userEventHandlers.indexOf(handleEvent), 1)
    }
  },
}
window.starknet = starknetWindowObject

window.addEventListener(
  "message",
  ({ data }: MessageEvent<WindowMessageType>) => {
    const { starknet } = window
    if (starknet && starknet.signer && data.type === "WALLET_CONNECTED") {
      const { address, network } = data.data
      if (address !== starknet.selectedAddress) {
        starknet.selectedAddress = address
        starknet.provider = new Provider({ network: network as any })
        starknet.signer = new WalletSigner(address, starknet.provider)
        for (const handleEvent of userEventHandlers) {
          handleEvent([address])
        }
      }
    }
  },
)

export class WalletSigner extends Provider implements SignerInterface {
  public address: string

  constructor(address: string, provider?: Provider) {
    super(provider || defaultProvider)
    this.address = address
  }

  public async addTransaction(
    transaction: Transaction,
  ): Promise<AddTransactionResponse> {
    if (transaction.type === "DEPLOY") return super.addTransaction(transaction)

    if (transaction.signature?.length)
      throw Error(
        "Adding signatures to a signer transaction currently isn't supported",
      )

    sendMessage({ type: "ADD_TRANSACTION", data: transaction })
    const { actionHash } = await waitForMsgOfType("ADD_TRANSACTION_RES", 1000)
    sendMessage({ type: "OPEN_UI" })

    const result = await Promise.race([
      waitForMsgOfType("SUBMITTED_TX", 11 * 60 * 1000),
      waitForMsgOfType("FAILED_TX", 10 * 60 * 1000)
        .then(() => "error" as const)
        .catch(() => {
          sendMessage({ type: "FAILED_TX", data: { actionHash } })
          return "timeout" as const
        }),
    ])

    if (result === "error") throw Error("User abort")
    if (result === "timeout") throw Error("User action timed out")

    return {
      code: "TRANSACTION_RECEIVED",
      address: transaction.contract_address,
      transaction_hash: result.txHash,
    }
  }

  public async hashMessage(data: typedData.TypedData): Promise<string> {
    return typedData.getMessageHash(data, this.address)
  }

  public async signMessage(data: typedData.TypedData): Promise<Signature> {
    sendMessage({ type: "ADD_SIGN", data })
    const { actionHash } = await waitForMsgOfType("ADD_SIGN_RES", 1000)
    sendMessage({ type: "OPEN_UI" })

    const result = await Promise.race([
      waitForMsgOfType("SUCCESS_SIGN", 11 * 60 * 1000),
      waitForMsgOfType("FAILED_SIGN", 10 * 60 * 1000)
        .then(() => "error" as const)
        .catch(() => {
          sendMessage({ type: "FAILED_SIGN", data: { actionHash } })
          return "timeout" as const
        }),
    ])

    if (result === "error") throw Error("User abort")
    if (result === "timeout") throw Error("User action timed out")

    return [result.r, result.s]
  }
}
