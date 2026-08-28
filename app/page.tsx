import type { Metadata } from 'next';
import { CreateRoomButton } from '@/features/landing/CreateRoomButton';
import { VoxelParade } from '@/features/landing/VoxelParade';
import styles from '@/features/landing/landing.module.css';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <main className={styles.page}>
      <VoxelParade />
      <div className={styles.card}>
        <header className={styles.brand}>
          <h1 className={styles.title}>복셀 공방</h1>
        </header>
        <p className={styles.lead}>내 사진으로 3D 방을 짓고, 친구에게 보내보세요.</p>
        <CreateRoomButton />
      </div>
    </main>
  );
}
