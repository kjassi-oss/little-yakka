export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-400 via-pink-300 to-blue-300 p-4">
      <main className="flex flex-col items-center justify-center gap-8 text-center">
        <div className="text-8xl animate-bounce">⭐</div>

        <h1 className="text-5xl md:text-6xl font-bold text-white drop-shadow-lg">
          Hello Little Yakka!
        </h1>

        <p className="text-xl md:text-2xl text-white drop-shadow-md max-w-md">
          Welcome to a happier way to manage chores, earn Stars, and celebrate wins together.
        </p>

        <div className="mt-8 p-6 bg-white rounded-2xl shadow-lg">
          <p className="text-lg text-gray-700">
            🚀 The app is ready to build. Let's make chores fun!
          </p>
        </div>
      </main>
    </div>
  );
}
