export function readGaMeasurementId(): string | null {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  return id && /^G-[A-Z0-9]+$/i.test(id) ? id : null;
}
