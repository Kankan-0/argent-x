import { BigNumber } from "@ethersproject/bignumber"
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { FC, useEffect, useMemo, useRef, useState } from "react"
import { number } from "starknet"
import styled from "styled-components"

import { AddToken } from "../../shared/token.model"
import { BackButton } from "../components/BackButton"
import { Button, ButtonGroupVertical } from "../components/Button"
import { Header } from "../components/Header"
import { InputText } from "../components/Input"
import { Spinner } from "../components/Spinner"
import { H2 } from "../components/Typography"
import { isValidAddress } from "../utils/addresses"
import { TokenDetails, fetchTokenDetails } from "../utils/tokens"

const AddTokenScreenWrapper = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 32px 48px 32px;

  > form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  ${Button} {
    margin-top: 64px;
  }
`

const isDataComplete = (data: TokenDetails): data is Required<TokenDetails> => {
  if (
    isValidAddress(data.address) &&
    data.balance?.toString() &&
    data.decimals?.toString() &&
    data.name &&
    data.symbol
  )
    return true
  return false
}

function addressFormat64Byte(address: number.BigNumberish): string {
  return `0x${number.toBN(address).toString("hex").padStart(64, "0")}`
}

interface AddTokenScreenProps {
  walletAddress: string
  networkId: string
  defaultToken?: AddToken
  onSubmit?: (addToken: Required<AddToken>) => void
  onReject?: () => void
  onBack?: () => void
}

export const AddTokenScreen: FC<AddTokenScreenProps> = ({
  walletAddress,
  networkId,
  defaultToken,
  onSubmit,
  onReject,
  onBack,
}) => {
  const [tokenAddress, setTokenAddress] = useState(defaultToken?.address || "")
  const [tokenName, setTokenName] = useState(defaultToken?.name || "")
  const [tokenSymbol, setTokenSymbol] = useState(defaultToken?.symbol || "")
  const [tokenDecimals, setTokenDecimals] = useState(
    defaultToken?.decimals || "0",
  )
  const [loading, setLoading] = useState(false)
  const [tokenDetails, setTokenDetails] = useState<TokenDetails>()
  const prevValidAddress = useRef("")

  const validAddress = useMemo(() => {
    return isValidAddress(tokenAddress)
  }, [tokenAddress])

  useEffect(() => {
    if (loading) {
      fetchTokenDetails(tokenAddress, walletAddress, networkId)
        .then((details) => {
          setLoading(false)
          setTokenDetails(details)
          setLoading(false)
        })
        .catch(() => {
          setLoading(false)
          setTokenDetails(undefined)
        })
    } else if (
      isValidAddress(tokenAddress) &&
      tokenAddress !== prevValidAddress.current
    ) {
      prevValidAddress.current = tokenAddress
      setLoading(true)
    }
  }, [loading, tokenAddress, walletAddress])

  const compiledData = {
    address: tokenAddress,
    ...(tokenDetails ?? {}),
    ...(!tokenDetails?.name && { name: tokenName }),
    ...(!tokenDetails?.symbol && { symbol: tokenSymbol }),
    ...(!tokenDetails?.decimals && {
      decimals: BigNumber.from(tokenDecimals || "0"),
    }),
    networkId,
  }

  return (
    <>
      <Header>{onBack && <BackButton onClick={onBack} />}</Header>

      <AddTokenScreenWrapper>
        <H2>Add token</H2>

        <form
          onSubmit={(e: any) => {
            e.preventDefault()
            if (isDataComplete(compiledData)) {
              onSubmit?.({
                address: compiledData.address,
                decimals: compiledData.decimals.toString(),
                name: compiledData.name,
                symbol: compiledData.symbol,
                networkId: compiledData.networkId,
              })
            }
          }}
        >
          <InputText
            autoFocus
            placeholder="Contract address"
            type="text"
            value={tokenAddress}
            disabled={loading}
            onChange={(e: any) => {
              setTokenAddress(e.target.value?.toLowerCase())
            }}
            onBlur={() => {
              try {
                if (tokenAddress)
                  setTokenAddress(addressFormat64Byte(tokenAddress))
              } catch {}
            }}
          />
          {!loading && (
            <>
              <InputText
                placeholder="Name"
                type="text"
                value={tokenDetails?.name ?? tokenName}
                disabled={tokenDetails?.name || loading || !validAddress}
                onChange={(e: any) => setTokenName(e.target.value)}
              />
              <InputText
                placeholder="Symbol"
                type="text"
                value={tokenDetails?.symbol ?? tokenSymbol}
                disabled={tokenDetails?.symbol || loading || !validAddress}
                onChange={(e: any) => setTokenSymbol(e.target.value)}
              />
              <InputText
                placeholder="Decimals"
                type="text"
                value={tokenDetails?.decimals?.toString() ?? tokenDecimals}
                disabled={
                  tokenDetails?.decimals?.toString() || loading || !validAddress
                }
                onChange={(e: any) => {
                  try {
                    BigNumber.from(e.target.value || "0")
                    setTokenDecimals(e.target.value)
                  } catch {}
                }}
              />
              <ButtonGroupVertical>
                {onReject && (
                  <Button onClick={onReject} type="button">
                    Reject
                  </Button>
                )}
                <Button type="submit" disabled={!isDataComplete(compiledData)}>
                  Continue
                </Button>
              </ButtonGroupVertical>
            </>
          )}
          {loading && <Spinner size={64} />}
        </form>
      </AddTokenScreenWrapper>
    </>
  )
}
