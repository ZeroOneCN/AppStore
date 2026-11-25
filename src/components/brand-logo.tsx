import Image from "next/image";

/**
 * 品牌 Logo：使用 public/logo.svg，保持正方形并按尺寸缩放。
 * @param props.size 显示边长（像素）
 * @param props.className 额外样式
 * @returns Logo 图片
 */
export function BrandLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.svg"
      alt="应用商店标志"
      width={size}
      height={size}
      unoptimized
      className={`shrink-0 rounded-[22%] shadow-[0_6px_16px_-8px_rgba(30,81,238,0.65)] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
