import React, { useState } from 'react';
import Bookings from '@/components/Bookings';
import Services from '@/components/Services';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import Properties from '@/components/Properties';
import Expenses from '@/components/Expenses';
import Activities from '@/components/Activities';
import Conditions from '@/components/Conditions';
import SuggestedPlan from '@/components/SuggestedPlan';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'bookings':
        return <Bookings />;
      case 'services':
        return <Services />;
      case 'dashboard':
        return <Dashboard />;
      case 'properties':
        return <Properties />;
      case 'expenses':
        return <Expenses />;
      case 'activities':
        return <Activities />;
      case 'conditions':
        return <Conditions />;
      case 'plan':
        return <SuggestedPlan />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Index;