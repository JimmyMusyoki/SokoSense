
import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { fetchKilimoData, fetchIndicators, fetchItems, KilimoData } from '../services/kilimoService';
import { motion } from 'motion/react';
import { TrendingUp, MapPin, Info, Loader2 } from 'lucide-react';

const KilimoStats: React.FC = () => {
  const [data, setData] = useState<KilimoData[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState<number>(2); // Production Quantity (Crops)
  const [selectedItem, setSelectedItem] = useState<number>(2); // Maize
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      const [inds, its] = await Promise.all([fetchIndicators(), fetchItems()]);
      setIndicators((inds || []).filter((i: any) => i.data_count > 0));
      setItems((its || []).filter((i: any) => i.data_count > 0));
      setLoading(false);
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const results = await fetchKilimoData(selectedIndicator, selectedItem);
      // Filter out 'KENYA' total to show county-level comparison
      const filteredResults = (results || []).filter(d => d.area_name !== 'KENYA');
      setData(filteredResults);
      setLoading(false);
    };
    loadData();
  }, [selectedIndicator, selectedItem]);

  const currentIndicator = indicators.find(i => i.id === selectedIndicator);
  const currentItem = items.find(i => i.id === selectedItem);

  return (
    <div className="space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="text-green-600" />
            Agricultural Market Insights
          </h1>
          <p className="text-gray-500 text-sm">Real-time statistics from KilimoSTAT</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase">Crop / Item</label>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(Number(e.target.value))}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase">Indicator</label>
            <select
              value={selectedIndicator}
              onChange={(e) => setSelectedIndicator(Number(e.target.value))}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
            >
              {indicators.map((ind) => (
                <option key={ind.id} value={ind.id}>
                  {ind.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin mb-2" />
          <p className="text-gray-500">Fetching latest market data...</p>
        </div>
      ) : data.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-800">
                {currentIndicator?.name} by County ({currentItem?.name})
              </h3>
              <div className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">
                {currentIndicator?.unit_name}
              </div>
            </div>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="area_name"
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    height={80}
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #f0f0f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`${value} ${currentIndicator?.unit_symbol}`, currentIndicator?.name]}
                  />
                  <Bar dataKey="data_value" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Side Insights */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm"
            >
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-600" />
                Top Producing Areas
              </h3>
              <div className="space-y-4">
                {[...data]
                  .sort((a, b) => b.data_value - a.data_value)
                  .slice(0, 5)
                  .map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs font-bold text-gray-500">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-700">{item.area_name}</span>
                      </div>
                      <span className="text-sm font-bold text-green-600">
                        {item.data_value.toLocaleString()} {item.unit_symbol}
                      </span>
                    </div>
                  ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-green-600 p-6 rounded-xl text-white shadow-lg shadow-green-200"
            >
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Market Tip
              </h3>
              <p className="text-sm text-green-50">
                Based on current yield data, areas like <strong>{[...data].sort((a, b) => b.data_value - a.data_value)[0]?.area_name}</strong> are showing high productivity. 
                Consider sourcing from these regions for better prices or selling in areas with lower production.
              </p>
            </motion.div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-gray-100 shadow-sm text-gray-500">
          <Info className="w-8 h-8 mb-2 opacity-20" />
          <p>No data available for this selection.</p>
        </div>
      )}
    </div>
  );
};

export default KilimoStats;
