import { getStarknet } from "@argent/get-starknet"
import { shortString } from "starknet"

import { erc20TokenAddressByNetwork } from "./token.service"

export const isWalletConnected = (): boolean => !!getStarknet()?.isConnected

export const connectWallet = async () =>
  await getStarknet({ showModal: true }).enable()

export const walletAddress = async (): Promise<string | undefined> => {
  try {
    const [address] = await getStarknet().enable()
    return address
  } catch {}
}

export const networkId = (): keyof typeof erc20TokenAddressByNetwork => {
  try {
    const baseUrl = getStarknet().provider.baseUrl
    if (baseUrl.includes("alpha-mainnet.starknet.io")) {
      return "mainnet-alpha"
    } else {
      return "goerli-alpha"
    }
  } catch {
    return "goerli-alpha"
  }
}

export const addToken = async (address: string): Promise<void> => {
  const starknet = getStarknet()
  await starknet.enable()
  await starknet.request({
    type: "wallet_watchAsset",
    params: {
      type: "ERC20",
      options: {
        address,
      },
    },
  })
}

export const getExplorerUrlBase = (): string => {
  if (networkId() === "mainnet-alpha") {
    return "https://voyager.online"
  } else {
    return "https://goerli.voyager.online"
  }
}

export const networkUrl = (): string | undefined => {
  try {
    return getStarknet().provider.baseUrl
  } catch {}
}

export const signMessage = async (message: string) => {
  const starknet = getStarknet()
  await starknet.enable()

  // checks that enable succeeded
  if (starknet.isConnected === false)
    throw Error("starknet wallet not connected")
  if (!shortString.isShortString(message)) {
    throw Error("message must be a short string")
  }

  return starknet.signer.signMessage({
    domain: {
      name: "Example DApp",
      chainId: networkId() === "mainnet-alpha" ? "SN_MAIN" : "SN_GOERLI",
      version: "0.0.1",
    },
    types: {
      StarkNetDomain: [
        { name: "name", type: "felt" },
        { name: "chainId", type: "felt" },
        { name: "version", type: "felt" },
      ],
      Message: [{ name: "message", type: "felt" }],
    },
    primaryType: "Message",
    message: {
      message,
    },
  })
}

export const waitForTransaction = async (hash: string) =>
  await getStarknet().provider.waitForTx(hash)

export const addWalletChangeListener = async (
  handleEvent: (accounts: string[]) => void,
) => {
  getStarknet().on("accountsChanged", handleEvent)
}
