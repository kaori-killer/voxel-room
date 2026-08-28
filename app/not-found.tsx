import Link from 'next/link';
import styles from '@/features/landing/landing.module.css';

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>방을 찾지 못했습니다</h1>
        <p className={styles.lead}>주소가 바뀌었거나 지워진 방일 수 있습니다.</p>
        <div className={styles.actions}>
          <Link className="btn btn-primary" href="/">
            처음으로
          </Link>
        </div>
      </div>
    </main>
  );
}
