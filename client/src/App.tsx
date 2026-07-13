import { Route, Routes } from 'react-router-dom';
import { Shell } from './Shell';
import { Wizard } from './Wizard';
import { Privacy, Terms } from './Legal';
import { Admin } from './Admin';

export default function App() {
  return <Shell><Routes>
    <Route path="/" element={<Wizard />} />
    <Route path="/privacidad" element={<Privacy />} />
    <Route path="/terminos" element={<Terms />} />
    <Route path="/admin" element={<Admin />} />
  </Routes></Shell>;
}
