import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '求职秘书｜你的求职工作台',
  description: '整理简历、分析岗位 JD、记录投递进展并练习每日面试题。',
  icons: { icon: './求职秘书-icon.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
