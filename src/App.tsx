import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './screens/Home'
import Create from './screens/Create'
import Lobby from './screens/Lobby'
import Field from './screens/Field'
import Notes from './screens/Notes'
import Command from './screens/Command'
import Report from './screens/Report'
import { applyTheme, getTheme } from './lib/identity'
import { startSync } from './lib/db'

export default function App() {
  useEffect(() => { applyTheme(getTheme()); startSync() }, [])
  return (
    <BrowserRouter basename="/discover">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<Create />} />
        <Route path="/s/:code" element={<Lobby />} />
        <Route path="/s/:code/field" element={<Field />} />
        <Route path="/s/:code/notes" element={<Notes />} />
        <Route path="/s/:code/command" element={<Command />} />
        <Route path="/s/:code/report" element={<Report />} />
      </Routes>
    </BrowserRouter>
  )
}
