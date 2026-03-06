import { createContext, useContext, useState, useEffect } from 'react'

const Ctx = createContext(null)
const USERS_KEY = 'cw_users'
const SESSION_KEY = 'cw_session'

const getUsers = () => { try { return JSON.parse(localStorage.getItem(USERS_KEY)||'[]') } catch { return [] } }
const saveUsers = u => localStorage.setItem(USERS_KEY, JSON.stringify(u))

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try { const s = localStorage.getItem(SESSION_KEY); if (s) setUser(JSON.parse(s)) } catch {}
    setLoading(false)
  }, [])

  const login = (email, pass) => {
    const users = getUsers()
    const found = users.find(u => u.email===email && u.pass===pass)
    if (users.find(u=>u.email===email) && !found) return { error: 'Wrong password.' }
    // Demo: allow any credentials
    const session = { email, name: found?.name || email.split('@')[0] }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    setUser(session)
    return { ok: true }
  }

  const signup = (email, pass, name) => {
    const users = getUsers()
    if (users.find(u=>u.email===email)) return { error: 'Email already registered.' }
    const n = name || email.split('@')[0]
    saveUsers([...users, { email, pass, name: n }])
    const session = { email, name: n }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    setUser(session)
    return { ok: true }
  }

  const logout = () => { localStorage.removeItem(SESSION_KEY); setUser(null) }

  return <Ctx.Provider value={{ user, login, signup, logout, loading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
