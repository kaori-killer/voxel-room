import type { Metadata } from 'next';
import { CreateRoomButton } from '@/features/landing/CreateRoomButton';
import styles from '@/features/landing/landing.module.css';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const FEATURES = [
  { term: '사진을 깎는다', detail: '사진 한 장의 픽셀을 정육면체로 쌓아 3D 오브제를 만듭니다.' },
  { term: '방에 놓는다', detail: '바닥 격자에 찰칵 붙여 옮기고, 돌리고, 크기를 맞춥니다.' },
  { term: '속성을 붙인다', detail: '캐릭터로 걷고, 전등을 켜고, 피아노를 치고, 음악을 틉니다.' },
  { term: '링크로 나눈다', detail: '방마다 주소가 하나씩. 보내면 그대로 열립니다.' },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <header className={styles.brand}>
          <span className={styles.cube} aria-hidden="true" />
          <h1 className={styles.title}>복셀 공방</h1>
        </header>
        <p className={styles.lead}>
          사진 한 장을 복셀 오브제로 깎아 내 방에 놓고 꾸밉니다.
          <br />
          변환은 전부 브라우저 안에서 끝납니다.
        </p>
        <CreateRoomButton />
        <dl className={styles.features}>
          {FEATURES.map((feature) => (
            <div key={feature.term} className={styles.feature}>
              <dt>{feature.term}</dt>
              <dd>{feature.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </main>
  );
}
