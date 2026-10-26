import { checkCurrentPassword, checkQuestions, saveQuestions } from '@/server/account'
import { requireUser } from '@/server/auth'
import { tx } from '@/server/db'
import { handle, json, readBody } from '@/server/http'

export const PUT = handle(async req => {
  const user = await requireUser()
  const body = await readBody(req)
  await checkCurrentPassword(user.id, body.current)
  const questions = checkQuestions(body.questions)
  await tx(c => saveQuestions(c, user.id, questions))
  return json({ ok: true })
})
