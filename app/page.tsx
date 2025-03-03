"use client";

import { SettingsProvider } from "@/lib/settings-provider";
import { ClientOnly } from "@/lib/client-only";
import { Inter } from "next/font/google";
import { useState } from "react";
import GenerateNote from "@/components/ready-to-use-examples/generate-note";
import SearchNote from "@/components/ready-to-use-examples/search-note";
import Summarizer from "@/components/ready-to-use-examples/export-summary";
import { RealtimeAudio } from "@/components/ready-to-use-examples/realtime-audio";

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export default function Page() {
  const [activeComponent, setActiveComponent] = useState<string | null>('Generate Note');

  const handleComponentSelect = (componentName: string) => {
    setActiveComponent(componentName);
  };

  // Function to render the active component
  const renderActiveComponent = () => {
    switch (activeComponent) {
      case 'Generate Note':
        return <GenerateNote />;
      case 'Search Note':
        return <SearchNote />;
      case 'Summarizer':
        return <Summarizer />
      case 'Last OCR Image':
        return <RealtimeAudio />
      case 'Audio Note':
        return <RealtimeAudio />
      default:
        return <p className="text-gray-500 text-center p-4">Select a component from the menu below</p>;
    }
  };

  return (
    <SettingsProvider>
      <ClientOnly>
        <div>
          <div className={`flex flex-col gap-6 items-center justify-center h-full mt-12 px-4 pb-32 ${inter.className}`}>
            <h1 className="text-2xl font-bold mb-0">AI Educational Notes</h1>
            <p className="text-gray-600 mb-2 -mt-5">Generate and manage educational notes using AI, screen capture, and audio transcription</p>
            
            <div className="w-full max-w-4xl">
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  {renderActiveComponent()}
              </div>
            </div>

            <div className="w-full max-w-4xl mt-8">
              <h2 className="text-xl font-semibold mb-4">Available Components</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => handleComponentSelect('Generate Note')}
                  className={`p-4 rounded-lg border ${activeComponent === 'Generate Note' ? 'bg-blue-100 border-blue-500' : 'bg-white hover:bg-gray-50'} text-left`}
                >
                  <h3 className="font-semibold text-lg">Generate Note</h3>
                  <p className="text-gray-600">Create new educational notes with AI assistance</p>
                </button>
                
                <button 
                  onClick={() => handleComponentSelect('Search Note')}
                  className={`p-4 rounded-lg border ${activeComponent === 'Search Note' ? 'bg-blue-100 border-blue-500' : 'bg-white hover:bg-gray-50'} text-left`}
                >
                  <h3 className="font-semibold text-lg">Search Note</h3>
                  <p className="text-gray-600">Find and retrieve your saved notes</p>
                </button>

                <button 
                  onClick={() => handleComponentSelect('Summarizer')}
                  className={`p-4 rounded-lg border ${activeComponent === 'Summarizer' ? 'bg-blue-100 border-blue-500' : 'bg-white hover:bg-gray-50'} text-left`}
                >
                  <h3 className="font-semibold text-lg">Summarize notes based on tags</h3>
                  <p className="text-gray-600">Summarize your saved notes</p>
                </button>
                
                <button 
                  onClick={() => handleComponentSelect('Audio Note')}
                  className={`p-4 rounded-lg border ${activeComponent === 'Audio Note' ? 'bg-blue-100 border-blue-500' : 'bg-white hover:bg-gray-50'} text-left`}
                >
                  <h3 className="font-semibold text-lg">Generate Audio Notes</h3>
                  <p className="text-gray-600">Generates notes based on RealtimeAudio</p>
                </button>
              </div>
            </div>
          </div>
          
          <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 ${inter.className}`}>
            <div className="container mx-auto max-w-4xl">
              <div className="flex justify-around p-4">
                <button 
                  onClick={() => handleComponentSelect('Generate Note')}
                  className={`px-4 py-2 rounded-md ${activeComponent === 'Generate Note' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  Generate Note
                </button>
                <button 
                  onClick={() => handleComponentSelect('Search Note')}
                  className={`px-4 py-2 rounded-md ${activeComponent === 'Search Note' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  Search Notes
                </button>
                <button 
                  onClick={() => handleComponentSelect('Summarizer')}
                  className={`px-4 py-2 rounded-md ${activeComponent === 'Summarizer' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  Summarize Notes
                </button>
                <button 
                  onClick={() => handleComponentSelect('Audio Note')}
                  className={`px-4 py-2 rounded-md ${activeComponent === 'Audio Note' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  Audio Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      </ClientOnly>
    </SettingsProvider>
  );
}