import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Store, Search, ShoppingCart } from 'lucide-react';

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: 'agent' | 'service';
  price: number;
  status: 'available' | 'sold';
  owner: string;
  imageUrl: string;
}

const mockItems: MarketplaceItem[] = [
  {
    id: 'item-001',
    name: 'Trading Bot Alpha',
    description: 'An AI agent optimized for crypto trading with high accuracy.',
    category: 'agent',
    price: 5.2,
    status: 'available',
    owner: '0x...a1b2',
    imageUrl: 'https://via.placeholder.com/150',
  },
  {
    id: 'item-002',
    name: 'NFT Monitor Service',
    description: 'A service to monitor NFT floor prices and alert on opportunities.',
    category: 'service',
    price: 2.5,
    status: 'available',
    owner: '0x...c3d4',
    imageUrl: 'https://via.placeholder.com/150',
  },
  {
    id: 'item-003',
    name: 'DeFi Yield Optimizer',
    description: 'AI agent for maximizing yield across DeFi protocols.',
    category: 'agent',
    price: 8.0,
    status: 'sold',
    owner: '0x...e5f6',
    imageUrl: 'https://via.placeholder.com/150',
  },
  {
    id: 'item-004',
    name: 'Wallet Security Audit',
    description: 'Service to audit wallet security and suggest improvements.',
    category: 'service',
    price: 1.8,
    status: 'available',
    owner: '0x...g7h8',
    imageUrl: 'https://via.placeholder.com/150',
  },
  {
    id: 'item-005',
    name: 'Risk Assessment Bot',
    description: 'AI agent to assess risk for Web3 investments.',
    category: 'agent',
    price: 4.5,
    status: 'available',
    owner: '0x...i9j0',
    imageUrl: 'https://via.placeholder.com/150',
  },
];

const Marketplace: React.FC = () => {
  const [items, setItems] = useState<MarketplaceItem[]>(mockItems);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'agent' | 'service'>('all');
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false);
  const [purchaseStatus, setPurchaseStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [purchaseMessage, setPurchaseMessage] = useState<string>('');

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, selectedCategory]);

  const handlePurchase = async (itemId: string) => {
    setIsPurchasing(true);
    setPurchaseStatus('idle');
    setPurchaseMessage('');

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setItems(prev => prev.map(item => {
        if (item.id === itemId && item.status === 'available') {
          return { ...item, status: 'sold' };
        }
        return item;
      }));
      setPurchaseStatus('success');
      setPurchaseMessage('Purchase successful! The item is now yours.');
    } catch (err) {
      setPurchaseStatus('error');
      setPurchaseMessage('Failed to complete purchase. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const getCategoryBadge = (category: MarketplaceItem['category']) => {
    return category === 'agent'
      ? <Badge variant="outline" className="bg-blue-100 text-blue-800">AI Agent</Badge>
      : <Badge variant="outline" className="bg-purple-100 text-purple-800">Service</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Store className="w-8 h-8 text-teal-600" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Marketplace</h1>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Decentralized Trading Hub</h2>
          <p className="text-gray-600 mb-4">
            Browse and trade AI agents and services built for Web3. All transactions are secured on the blockchain.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
              className={selectedCategory === 'all' ? 'bg-teal-50 text-teal-700 hover:bg-teal-100' : ''}
            >
              All
            </Button>
            <Button
              variant={selectedCategory === 'agent' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('agent')}
              className={selectedCategory === 'agent' ? 'bg-teal-50 text-teal-700 hover:bg-teal-100' : ''}
            >
              AI Agents
            </Button>
            <Button
              variant={selectedCategory === 'service' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('service')}
              className={selectedCategory === 'service' ? 'bg-teal-50 text-teal-700 hover:bg-teal-100' : ''}
            >
              Services
            </Button>
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.length === 0 ? (
            <div className="col-span-full text-center py-10 text-gray-500">No items match your search or filter.</div>
          ) : (
            filteredItems.map(item => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-sm p-4 border border-gray-100 hover:shadow-md transition-shadow"
              >
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-40 object-cover rounded-md mb-4 bg-gray-200"
                />
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
                  {getCategoryBadge(item.category)}
                </div>
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>
                <div className="flex justify-between items-center text-sm mb-3">
                  <span className="text-gray-500">Owner: {item.owner.slice(0, 6)}...{item.owner.slice(-4)}</span>
                  <span className="font-medium text-gray-800">{item.price} SOL</span>
                </div>
                <div className="flex justify-between items-center">
                  {item.status === 'sold' ? (
                    <Badge variant="destructive" className="bg-red-100 text-red-800">Sold</Badge>
                  ) : (
                    <Badge variant="default" className="bg-green-100 text-green-800">Available</Badge>
                  )}
                  {item.status === 'available' && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          onClick={() => setSelectedItem(item)}
                          className="flex items-center gap-1 bg-teal-50 text-teal-700 hover:bg-teal-100"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          Buy Now
                        </Button>
                      </DialogTrigger>
                      {selectedItem?.id === item.id && (
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Confirm Purchase</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <p className="text-gray-600">
                              You are about to purchase <strong>{selectedItem.name}</strong> for <strong>{selectedItem.price} SOL</strong>.
                              Confirm the transaction to proceed.
                            </p>
                            <div className="flex justify-center gap-3">
                              <Button
                                variant="outline"
                                onClick={() => setSelectedItem(null)}
                                disabled={isPurchasing}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => handlePurchase(selectedItem.id)}
                                disabled={isPurchasing}
                                className="bg-teal-50 text-teal-700 hover:bg-teal-100"
                              >
                                {isPurchasing ? 'Processing...' : 'Confirm Purchase'}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      )}
                    </Dialog>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {purchaseStatus === 'success' && (
          <div className="fixed bottom-4 right-4 p-4 bg-green-50 text-green-700 rounded-md shadow-lg">
            {purchaseMessage}
          </div>
        )}
        {purchaseStatus === 'error' && (
          <div className="fixed bottom-4 right-4 p-4 bg-red-50 text-red-700 rounded-md shadow-lg">
            {purchaseMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default Marketplace;
