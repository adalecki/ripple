import React from 'react'
import ReactDOM from 'react-dom/client'

import './css/flatly.css'

import Router from './router'


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
)
