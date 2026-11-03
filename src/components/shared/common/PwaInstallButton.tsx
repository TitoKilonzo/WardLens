import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) return;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }

    function handleAppInstalled() {
      setInstallPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (!installPrompt) return null;

  return <button type="button" className="button button-primary pwa-install-button" onClick={installApp}>
    <Download size={16}/> Get the App
  </button>;
}
