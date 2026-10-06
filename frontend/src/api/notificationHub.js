import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { apiOrigin } from './apiConfig'

const hubUrl = `${apiOrigin || window.location.origin}/hubs/notifications`

export async function connectNotificationHub({
  groupMethod,
  groupArguments = [],
  additionalGroupInvocations = [],
  handlers = {},
  onConnectionStateChange,
}) {
  const connection = new HubConnectionBuilder()
    .withUrl(hubUrl)
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(LogLevel.Warning)
    .build()

  Object.entries(handlers).forEach(([eventName, handler]) => connection.on(eventName, handler))
  const joinGroups = async () => {
    await connection.invoke(groupMethod, ...groupArguments)
    await Promise.all(additionalGroupInvocations.map(({ method, arguments: argumentsList = [] }) => (
      connection.invoke(method, ...argumentsList)
    )))
  }
  connection.onreconnecting(() => onConnectionStateChange?.(false))
  connection.onclose(() => onConnectionStateChange?.(false))
  connection.onreconnected(async () => {
    try {
      await joinGroups()
      onConnectionStateChange?.(true)
    } catch {
      // The next automatic reconnect attempt will retry the group join.
      onConnectionStateChange?.(false)
    }
  })

  try {
    await connection.start()
    await joinGroups()
  } catch (error) {
    onConnectionStateChange?.(false)
    await connection.stop()
    throw error
  }
  onConnectionStateChange?.(true)

  return connection
}
