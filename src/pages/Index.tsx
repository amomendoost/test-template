import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Sparkles } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 p-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm border border-neutral-200 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-2xl flex items-center justify-center mx-auto transition-transform duration-300 hover:scale-110">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-neutral-900">
              0xminds boilerplate
            </h1>
            <p className="text-neutral-600 leading-relaxed">
              Edit this page to get started.
            </p>
          </div>
          
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;