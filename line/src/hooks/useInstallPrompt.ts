'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'install-prompt-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export type InstallPlatform = 'android' | 'ios' | null;

export function useInstallPrompt() {
  const [platform, setPlatform] = useState<InstallPlatform>(null);
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');

    if (isStandalone()) return;

    if (isIos()) {
      setPlatform('ios'); // iOSはbeforeinstallprompt非対応のため手順案内のみ表示
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
      setPlatform('android');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const promptInstall = async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    if (outcome === 'accepted') dismiss();
    setDeferredEvent(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return { platform, show: !dismissed && platform !== null, promptInstall, dismiss };
}
