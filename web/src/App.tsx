import type { ReactNode } from 'react'
import { useApp } from './state/useApp'
import Stage from './components/shell/Stage'
import CarPanel from './components/shell/CarPanel'
import SafetyBanner from './components/shell/SafetyBanner'
import AlertOffer from './components/shell/AlertOffer'
import SOS from './components/shell/SOS'
import Countdown from './components/shell/Countdown'
import Settings from './components/shell/Settings'
import Home from './screens/Home'
import Checking, { Log } from './screens/Checking'
import Diagnosis from './screens/Diagnosis'
import StepPlayer from './screens/StepPlayer'
import Result from './screens/Result'
import DIY from './screens/DIY'
import Shops from './screens/Shops'
import Inbox from './screens/Inbox'

const Waiting = ({ text }: { text: string }) => (
  <div className="phone-body"><span className="chip pulse"><span className="dot" />{text}</span></div>
)

export default function App() {
  const { s, actions } = useApp()
  const friendName = s.friends[0]?.name ?? 'Priya'
  const latestAlert = s.alerts[s.alerts.length - 1] ?? null
  const sentAlert = [...s.alerts].reverse().find((a) => a.trigger === 'verdict') ?? null

  let screen: ReactNode
  switch (s.screen) {
    case 'home':
      screen = <Home up={s.backendUp} onAsk={actions.ask} onSettings={actions.openSettings} />
      break
    case 'checking':
      screen = <Checking log={s.log} busy={s.busy} up={s.backendUp} />
      break
    case 'banner':
      screen = (
        <div className="phone-body">
          {s.triage && <SafetyBanner triage={s.triage} />}
          <AlertOffer friends={s.friends} shareLocation={s.settings.share_location} status={s.offer} sentAlert={sentAlert} ack={s.lastAck} onSend={actions.sendOffer} onDecline={actions.declineOffer} />
          <button className="btn block" style={{ marginTop: 14 }} onClick={() => actions.go('diagnosis')} disabled={!s.diagnosis}>
            {s.diagnosis ? "See what's wrong" : 'Working out what is wrong…'}
          </button>
          <div className="h2" style={{ marginTop: 24 }}>What the car said</div>
          <Log log={s.log} />
          <div className="ai-notice">AI was used.</div>
        </div>
      )
      break
    case 'diagnosis':
      screen = s.snapshot ? <Diagnosis snapshot={s.snapshot} diagnosis={s.diagnosis} step={s.step} onShowMe={() => actions.go('step')} /> : <Waiting text="Connecting to the car" />
      break
    case 'step':
      screen = s.step ? (
        <>
          {s.busy && <div style={{ padding: '6px 18px 0' }}><span className="chip pulse"><span className="dot" />Asking the car again</span></div>}
          <StepPlayer spec={s.step.spec} gate={s.step.gate} onDidIt={actions.didIt} />
        </>
      ) : s.stepBlocked ? (
        <div className="phone-body">
          <div className="card" style={{ borderColor: 'var(--caution)' }}>
            <div className="h2">Not yet</div>
            <p>The rulebook blocked this step. Missing: {s.stepBlocked.missing.join(', ')}.</p>
          </div>
        </div>
      ) : <Waiting text="Working out the cheapest test" />
      break
    case 'result':
      screen = s.snapshot ? <Result snapshot={s.snapshot} diagnosis={s.diagnosis} fairPrice={s.fairPrice} onDiy={() => actions.go('diy')} onShops={() => actions.go('shops')} /> : <Waiting text="Connecting to the car" />
      break
    case 'diy':
      screen = <DIY fairPrice={s.fairPrice} spec={s.step?.spec ?? null} />
      break
    case 'shops':
      screen = <Shops shops={s.shops} onSent={actions.onSent} />
      break
    case 'inbox':
      screen = <Inbox quotes={s.quotes} fairPrice={s.fairPrice} />
      break
  }

  const overlay = (
    <>
      <SOS onPress={actions.sos} />
      {s.settingsOpen && <Settings friends={s.friends} settings={s.settings} onAdd={actions.addFriend} onRemove={actions.removeFriend} onShare={actions.setShare} onClose={actions.closeSettings} />}
      {s.countdown && (
        <Countdown
          key={`${s.countdown.kind}-${s.countdown.event?.at ?? ''}`}
          seconds={s.countdown.seconds}
          label={s.countdown.kind === 'sos' ? `Sending to ${friendName} in {n}` : `Are you OK? Alerting ${friendName} in {n}`}
          cancelLabel={s.countdown.kind === 'sos' ? 'Cancel' : "I'm OK, cancel"}
          doneLabel={`Sending to ${friendName}`}
          onCancel={actions.cancelCountdown}
          onDone={actions.countdownDone}
        />
      )}
    </>
  )

  return (
    <Stage
      carPanel={<CarPanel snapshot={s.snapshot} up={s.backendUp} onScenario={actions.scenario} />}
      maya={screen}
      overlay={overlay}
      alert={latestAlert}
      friendName={friendName}
      onAck={actions.ack}
      onHome={actions.reset}
    />
  )
}
