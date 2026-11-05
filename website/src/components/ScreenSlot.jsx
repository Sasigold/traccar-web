import { BrandSymbol } from '../../../src/common/components/brand/BrandLogo';

// A screenshot, or until one is supplied, a designed placeholder that says what goes here
// and at what size. Configure the images in src/config.js.
const ScreenSlot = ({ screen, className = '', priority = false }) => {
  const { src, label, size, ratio } = screen;
  return (
    <figure
      className={`slot ${src ? 'slot--img' : 'slot--empty'} ${className}`}
      style={{ aspectRatio: ratio }}
    >
      {src ? (
        <img src={src} alt={label} loading={priority ? 'eager' : 'lazy'} decoding="async" />
      ) : (
        <div className="slot__empty" role="img" aria-label={`מקום לצילום מסך: ${label}`}>
          <span className="slot__corner slot__corner--a" />
          <span className="slot__corner slot__corner--b" />
          <span className="slot__corner slot__corner--c" />
          <span className="slot__corner slot__corner--d" />
          <BrandSymbol size={36} />
          <strong>{label}</strong>
          <span className="slot__hint">כאן ייכנס צילום מסך</span>
          <span className="slot__size" dir="ltr">
            {size} · {ratio.replace(/\s/g, '')}
          </span>
        </div>
      )}
    </figure>
  );
};

export default ScreenSlot;
