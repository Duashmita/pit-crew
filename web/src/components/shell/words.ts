const CALL: Record<string, string> = { stop_now: "Don't drive", short_trip_only: 'Short trip only', ok_to_drive: 'OK to drive', unknown: 'Needs help' }
export const callWords = (c: string) => CALL[c] ?? c
export const timeOf = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
