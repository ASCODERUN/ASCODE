import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Bot, Save, RotateCcw } from 'lucide-react';

interface FormData {
  name: string;
  type: string;
  aggression: number;
  riskTolerance: number;
  autoDeploy: boolean;
}

const AgentSetup: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: 'trading',
    aggression: 50,
    riskTolerance: 50,
    autoDeploy: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.type) {
      newErrors.type = 'Type is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
    setSubmitStatus('idle');
    setStatusMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setStatusMessage('');

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSubmitStatus('success');
      setStatusMessage('Agent setup completed successfully! Your AI agent is ready.');
    } catch (err) {
      setSubmitStatus('error');
      setStatusMessage('Failed to setup agent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      name: '',
      type: 'trading',
      aggression: 50,
      riskTolerance: 50,
      autoDeploy: false,
    });
    setErrors({});
    setSubmitStatus('idle');
    setStatusMessage('');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Bot className="w-8 h-8 text-indigo-600" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Setup AI Agent</h1>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700">Agent Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => handleInputChange('name', e.target.value)}
                  placeholder="e.g., Trading Bot Alpha"
                  className="w-full"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.name}
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type" className="text-sm font-medium text-gray-700">Agent Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={value => handleInputChange('type', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trading">Trading Bot</SelectItem>
                    <SelectItem value="nft">NFT Monitor</SelectItem>
                    <SelectItem value="yield">Yield Optimizer</SelectItem>
                    <SelectItem value="governance">Governance Voter</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-sm text-red-500">{errors.type}</p>}
              </div>

              <div className="space-y-4">
                <Label htmlFor="aggression" className="text-sm font-medium text-gray-700">Aggression Level ({formData.aggression}%)</Label>
                <Slider
                  id="aggression"
                  value={[formData.aggression]}
                  onValueChange={value => handleInputChange('aggression', value[0])}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500">Higher values make the agent more proactive in actions.</p>
              </div>

              <div className="space-y-4">
                <Label htmlFor="riskTolerance" className="text-sm font-medium text-gray-700">Risk Tolerance ({formData.riskTolerance}%)</Label>
                <Slider
                  id="riskTolerance"
                  value={[formData.riskTolerance]}
                  onValueChange={value => handleInputChange('riskTolerance', value[0])}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500">Higher values allow riskier decisions for potential higher returns.</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-md">
              <div className="space-y-1">
                <Label htmlFor="autoDeploy" className="text-sm font-medium text-gray-700">Auto-Deploy on Solana Network</Label>
                <p className="text-xs text-gray-500">Enable to automatically deploy the agent after setup.</p>
              </div>
              <Switch
                id="autoDeploy"
                checked={formData.autoDeploy}
                onCheckedChange={value => handleInputChange('autoDeploy', !!value)}
                disabled={isSubmitting}
              />
            </div>

            {submitStatus === 'success' && (
              <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-md">
                {statusMessage}
              </div>
            )}
            {submitStatus === 'error' && (
              <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
                {statusMessage}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isSubmitting}
                className="flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Setting Up...' : 'Save & Deploy'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AgentSetup;
