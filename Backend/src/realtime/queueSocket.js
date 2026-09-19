let ioServer = null

export function configureQueueSocket(io) {
  ioServer = io

  io.on('connection', (socket) => {
    socket.join('queue')
    console.log(`Queue socket connected: ${socket.id} (${socket.conn.transport.name})`)

    socket.on('disconnect', (reason) => {
      console.log(`Queue socket disconnected: ${socket.id} (${reason})`)
    })
  })
}

export function emitQueueUpdated(change, entryId = null) {
  if (!ioServer) return

  ioServer.to('queue').emit('queue:updated', {
    change,
    entryId,
    changedAt: new Date().toISOString(),
  })
}
