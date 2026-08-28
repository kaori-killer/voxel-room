import Script from 'next/script';
import { readGaMeasurementId } from '@/lib/analytics';

/** 측정 ID 가 없으면 아무 스크립트도 넣지 않는다. */
export function GoogleAnalytics() {
  const measurementId = readGaMeasurementId();
  if (!measurementId) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}',{anonymize_ip:true});`}
      </Script>
    </>
  );
}
