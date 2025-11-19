/**
 * Test page for Design Mode functionality
 * This component will be tagged by 0x-tagger plugin
 */

export default function TestDesignMode() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">
          Design Mode Test Page
        </h1>

        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <h2 className="text-2xl font-semibold text-slate-800 mb-4">
            Welcome to 0xminds
          </h2>
          <p className="text-slate-600 mb-4">
            This is a test page to verify that component tagging is working correctly.
            Each element should have data-0x-* attributes.
          </p>

          <div className="flex gap-4">
            <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition">
              Primary Button
            </button>
            <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg transition">
              Secondary Button
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-xl p-6">
          <h3 className="text-xl font-bold text-white mb-2">
            Featured Section
          </h3>
          <p className="text-white/90">
            Click on any element in Design Mode to edit its properties.
          </p>
        </div>
      </div>
    </div>
  );
}
