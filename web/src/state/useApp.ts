import { useEffect, useMemo, useReducer, useRef } from 'react'
import { api } from '../lib/api'
import { initial, reduce, type Screen } from './machine'
import type { AckAction, Scenario } from '../types'

export function useApp() {
  const [s, dispatch] = useReducer(reduce, initial)
  const ref = useRef(s)
  ref.current = s

  useEffect(() => {
    let alive = true
    api.health().then((h) => alive && dispatch({ type: 'backend', up: true, mode: h.mode })).catch(() => alive && dispatch({ type: 'backend', up: false }))
    api.friends().then((f) => alive && dispatch({ type: 'friends', friends: f })).catch(() => {})
    api.settings().then((x) => alive && dispatch({ type: 'settings', settings: x })).catch(() => {})
    const poll = async () => {
      try { const snap = await api.car(); if (alive) dispatch({ type: 'snapshot', snapshot: snap }) }
      catch { if (alive) dispatch({ type: 'backend', up: false }) }
    }
    poll()
    const id = setInterval(poll, 1000)
    const off = api.events((e) => alive && dispatch({ type: 'event', event: e }))
    return () => { alive = false; clearInterval(id); off() }
  }, [])

  useEffect(() => {
    if ((s.screen === 'result' || s.screen === 'diy' || s.screen === 'inbox') && !s.fairPrice)
      api.fairPrice().then((fp) => dispatch({ type: 'fairPrice', fairPrice: fp })).catch(() => {})
    if (s.screen === 'shops' && !s.shops.length)
      api.shops().then((sh) => dispatch({ type: 'shops', shops: sh })).catch(() => {})
    if (s.screen === 'inbox') {
      const id = setTimeout(() => api.inbox().then((q) => dispatch({ type: 'quotes', quotes: q })).catch(() => {}), 3500)
      return () => clearTimeout(id)
    }
  }, [s.screen, s.fairPrice, s.shops.length])

  const actions = useMemo(() => {
    const friendName = () => ref.current.friends[0]?.name ?? 'Priya'
    return {
      ask: async (words: string) => {
        dispatch({ type: 'ask' })
        try {
          const r = await api.diagnose(words)
          if (!ref.current.triage) r.events.forEach((e) => dispatch({ type: 'event', event: e }))
        } catch { dispatch({ type: 'busy', busy: false }) }
      },
      go: (screen: Screen) => dispatch({ type: 'go', screen }),
      reset: () => dispatch({ type: 'reset' }),
      scenario: (name: Scenario) => api.setScenario(name).then((snap) => dispatch({ type: 'snapshot', snapshot: snap })).catch(() => {}),
      sendOffer: async (include: boolean) => {
        try { dispatch({ type: 'alert', alert: await api.alert('verdict', include) }) } catch { /* backend not ready */ }
      },
      declineOffer: () => dispatch({ type: 'offer', status: 'declined' }),
      sos: () => dispatch({ type: 'countdown', countdown: { kind: 'sos', seconds: 3 } }),
      countdownDone: async () => {
        const c = ref.current.countdown
        if (c?.kind !== 'sos') return
        try { dispatch({ type: 'alert', alert: await api.alert('sos', ref.current.settings.share_location) }) }
        catch { dispatch({ type: 'countdown', countdown: null }) }
      },
      cancelCountdown: () => {
        if (ref.current.countdown?.kind === 'car_event') api.cancelAlert().catch(() => {})
        dispatch({ type: 'countdown', countdown: null })
      },
      didIt: async () => {
        const spec = ref.current.step?.spec
        if (!spec) return
        dispatch({ type: 'busy', busy: true })
        try {
          const r = await api.didIt(spec.id)
          if (ref.current.screen === 'step') r.events.forEach((e) => dispatch({ type: 'event', event: e }))
        } catch { dispatch({ type: 'busy', busy: false }) }
      },
      ack: async (id: string, action: AckAction) => {
        const by = friendName()
        try { dispatch({ type: 'alert', alert: await api.ack(id, by, action) }) } catch { /* keep local */ }
        dispatch({ type: 'event', event: { type: 'ack', alert_id: id, by, action } })
      },
      addFriend: async (f: { name: string; relation: string; phone: string }) => {
        try { await api.addFriend(f); dispatch({ type: 'friends', friends: await api.friends() }) } catch { /* ignore */ }
      },
      removeFriend: async (id: string) => {
        try { await api.removeFriend(id); dispatch({ type: 'friends', friends: await api.friends() }) } catch { /* ignore */ }
      },
      setShare: async (on: boolean) => {
        dispatch({ type: 'settings', settings: { share_location: on } })
        try { dispatch({ type: 'settings', settings: await api.setSettings({ share_location: on }) }) } catch { /* keep local */ }
      },
      tellFriend: async () => {
        try { dispatch({ type: 'alert', alert: await api.alert('verdict', ref.current.settings.share_location) }) } catch { /* backend not ready */ }
      },
      chatClear: () => dispatch({ type: 'chatClear' }),
      openSettings: () => dispatch({ type: 'settingsOpen', open: true }),
      closeSettings: () => dispatch({ type: 'settingsOpen', open: false }),
      onSent: () => dispatch({ type: 'go', screen: 'inbox' }),
    }
  }, [])

  return { s, actions }
}
