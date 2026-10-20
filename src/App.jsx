import React, { useEffect, useState } from 'react';
import { getHealth } from './api';

export default function App() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    getHealth().then(setHealth);
  }, []);

  return (
    <div>
      <h1>SehatPlate</h1>
      <pre>{health ? JSON.stringify(health, null, 2) : 'Loading...'}</pre>
    </div>
  );
}
