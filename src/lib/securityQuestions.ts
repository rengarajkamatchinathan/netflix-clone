// Security questions offered at sign-up. Shared by the app and the server.
// Keys are stored in the database, so don't rename existing ones.
export const SECURITY_QUESTIONS: Record<string, string> = {
  pet: "What was your first pet's name?",
  city: 'What city were you born in?',
  school: 'What was the name of your first school?',
  friend: "What is your childhood best friend's first name?",
  cartoon: 'What was your favourite cartoon as a kid?',
  street: 'What street did you grow up on?',
  teacher: 'What was the surname of your favourite teacher?',
}

export const QUESTION_KEYS = Object.keys(SECURITY_QUESTIONS)

// Answers match ignoring case and extra spaces.
export const normalizeAnswer = (a: unknown): string => String(a ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
