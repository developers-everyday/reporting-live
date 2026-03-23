"use client";

import { useState } from 'react';
import Onboarding from '../components/Onboarding';
import MainScreen from '../components/MainScreen';

export default function Home() {
  const [isOnboarded, setIsOnboarded] = useState(false);

  return (
    <main>
      {!isOnboarded ? (
         <Onboarding onComplete={() => setIsOnboarded(true)} />
      ) : (
         <MainScreen />
      )}
    </main>
  );
}
