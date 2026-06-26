export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl animate-pulse" style={{ background: 'var(--theme-gradient)' }}/>
        <div className="text-2xl animate-bounce">⭐</div>
      </div>
    </div>
  )
}
