import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { apiOrigin } from './apiConfig'

const hubUrl = `${apiOrigin || window.location.origin}/hubs/notifications`

export async function connectNotificationHub({ groupMethod, groupArguments = [], handlers = {} }) {
  const connection = new HubConnectionBuilder()
    .withUrl(hubUrl)
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(LogLevel.Warning)
    .build()

  Object.entries(handlers).forEach(([eventName, handler]) => connection.on(eventName, handler))
  connection.onreconnected(async () => {
    try {
      await connection.invoke(groupMethod, ...groupArguments)
    } catch {
      // The next automatic reconnect attempt will retry the group join.
    }
  })

  await connection.start()
  await connection.invoke(groupMethod, ...groupArguments)

  return connection
}
