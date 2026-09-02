import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { apiOrigin } from './apiConfig'

const hubUrl = `${apiOrigin || window.location.origin}/hubs/notifications`

export async function connectNotificationHub({
  groupMethod,
  groupArguments = [],
  handlers = {},
  onConnectionStateChange,
}) {
  const connection = new HubConnectionBuilder()
    .withUrl(hubUrl)
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(LogLevel.Warning)
    .build()

  Object.entries(handlers).forEach(([eventName, handler]) => connection.on(eventName, handler))
  connection.onreconnecting(() => onConnectionStateChange?.(false))
  connection.onclose(() => onConnectionStateChange?.(false))
  connection.onreconnected(async () => {
    try {
      await connection.invoke(groupMethod, ...groupArguments)
      onConnectionStateChange?.(true)
    } catch {
      // The next automatic reconnect attempt will retry the group join.
      onConnectionStateChange?.(false)
    }
  })

  await connection.start()
  await connection.invoke(groupMethod, ...groupArguments)
  onConnectionStateChange?.(true)

  return connection
}
