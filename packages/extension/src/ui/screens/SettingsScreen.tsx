import { FC } from "react"
import styled from "styled-components"

import { sendMessage } from "../../shared/messages"
import { BackButton } from "../components/BackButton"
import { Button } from "../components/Button"
import { Header } from "../components/Header"
import { InputText } from "../components/Input"
import { H2, P } from "../components/Typography"

const SettingsScreenWrapper = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px 32px 48px;

  > ${P} {
    margin: 16px 0;
  }

  ${Button} {
    margin-top: 10px;
  }
`

interface SettingsScreenProps {
  onBack: () => void
  onLock: () => void
  port: number
  onPortChange: (port: number) => void
}

export const SettingsScreen: FC<SettingsScreenProps> = ({
  onBack,
  onLock,
  port,
  onPortChange,
}) => (
  <>
    <Header>
      <BackButton onClick={onBack} />
    </Header>
    <SettingsScreenWrapper>
      <H2>Settings</H2>
      <P>
        Dapps you have previously connected to can auto-connect in the future.
        Require all dapps to request a new connection to your wallet?
      </P>
      <Button
        onClick={() => {
          sendMessage({ type: "RESET_WHITELIST" })
          onBack()
        }}
      >
        Reset dapp connections
      </Button>
      <Button
        onClick={() => {
          sendMessage({ type: "STOP_SESSION" })
          onLock()
        }}
      >
        Lock wallet
      </Button>
      <InputText
        placeholder="Local node port number"
        type="number"
        value={port}
        onChange={(e: any) => onPortChange(e.target.value)}
        style={{ marginTop: 20 }}
      />
    </SettingsScreenWrapper>
  </>
)
