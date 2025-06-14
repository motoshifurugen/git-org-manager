// backend/src/index.ts
import express from 'express'
import cors from 'cors'
import orgTreeRouter from './routes/tree'
import nodeRouter from './routes/node'
import commitRouter from './routes/commit'
import tagRouter from './routes/tag'
import userRouter from './routes/user'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api', orgTreeRouter)
app.use('/api', nodeRouter)
app.use('/api', commitRouter)
app.use('/api', tagRouter)
app.use('/api', userRouter)

app.listen(3001, () => {
  console.log('Server is running at http://localhost:3001')
})
