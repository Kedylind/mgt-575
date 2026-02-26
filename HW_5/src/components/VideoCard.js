export default function VideoCard({ title, thumbnailUrl, url }) {
  const openVideo = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="video-card" onClick={openVideo} onKeyDown={(e) => e.key === 'Enter' && openVideo()} role="button" tabIndex={0}>
      {thumbnailUrl && (
        <div className="video-card-thumb">
          <img src={thumbnailUrl} alt="" />
        </div>
      )}
      <div className="video-card-info">
        <span className="video-card-title">{title || 'Video'}</span>
        <span className="video-card-play">▶ Play in new tab</span>
      </div>
    </div>
  );
}
