// Shown at once on navigating between viewer pages, while the next one renders.
export default function Loading() {
  return (
    <div className="page-skel" aria-busy="true" aria-label="Loading">
      <div className="skel skel-hero" />
      {[0, 1, 2].map(r => <div key={r} className="skel-row">{[0, 1, 2, 3, 4, 5].map(i => <span key={i} className="skel" />)}</div>)}
    </div>
  )
}
