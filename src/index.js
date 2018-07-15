require('http').createServer().listen(3000)

import Bot from './Bot'
import { botToken } from './secret'
new Bot(botToken)
