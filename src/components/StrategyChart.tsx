import React from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';

interface TradePoint {
  x: number;
  y: number;
  type: 'buy' | 'sell';
  date: string;
  price: number;
  reason: string;
}

interface ChartData {
  x: number;
  y: number;
  date: string;
  volume: number;
}

interface StrategyChartProps {
  priceData: ChartData[];
  trades: TradePoint[];
  indicators?: {
    sma20?: { x: number; y: number }[];
    sma50?: { x: number; y: number }[];
    rsi?: { x: number; y: number }[];
    macd?: { x: number; y: number }[];
  };
  strategy: {
    name: string;
    performance: {
      totalReturn: number;
      winRate: number;
      totalTrades: number;
    };
  };
}

const { width } = Dimensions.get('window');
const chartWidth = width - 40;
const chartHeight = 250;

const StrategyChart: React.FC<StrategyChartProps> = ({ 
  priceData, 
  trades, 
  indicators = {}, 
  strategy 
}) => {
  const buyTrades = trades.filter(trade => trade.type === 'buy');
  const sellTrades = trades.filter(trade => trade.type === 'sell');

  // Calculate chart dimensions and scales
  const padding = 40;
  const chartInnerWidth = chartWidth - (padding * 2);
  const chartInnerHeight = chartHeight - (padding * 2);

  // Find min/max values for scaling
  const prices = priceData.map(d => d.y);
  const minPrice = Math.min(...prices) * 0.98;
  const maxPrice = Math.max(...prices) * 1.02;
  const priceRange = maxPrice - minPrice;

  // Helper functions for coordinate transformation
  const getX = (index: number) => padding + (index / Math.max(priceData.length - 1, 1)) * chartInnerWidth;
  const getY = (price: number) => padding + ((maxPrice - price) / priceRange) * chartInnerHeight;

  // Generate path for price line
  const pricePath = priceData.map((point, index) => {
    const x = getX(index);
    const y = getY(point.y);
    return index === 0 ? `M${x},${y}` : `L${x},${y}`;
  }).join(' ');

  // Generate paths for SMA lines
  const sma20Path = indicators.sma20 ? indicators.sma20.map((point, index) => {
    const x = getX(point.x);
    const y = getY(point.y);
    return index === 0 ? `M${x},${y}` : `L${x},${y}`;
  }).join(' ') : '';

  const sma50Path = indicators.sma50 ? indicators.sma50.map((point, index) => {
    const x = getX(point.x);
    const y = getY(point.y);
    return index === 0 ? `M${x},${y}` : `L${x},${y}`;
  }).join(' ') : '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{strategy.name} Strategy</Text>
        <View style={styles.performanceRow}>
          <Text style={styles.performanceText}>
            Return: <Text style={{ color: strategy.performance.totalReturn > 0 ? '#4CAF50' : '#F44336' }}>
              {strategy.performance.totalReturn > 0 ? '+' : ''}{strategy.performance.totalReturn.toFixed(2)}%
            </Text>
          </Text>
          <Text style={styles.performanceText}>
            Win Rate: {strategy.performance.winRate.toFixed(1)}%
          </Text>
          <Text style={styles.performanceText}>
            Trades: {strategy.performance.totalTrades}
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartContainer}>
        <Svg width={Math.max(chartWidth, priceData.length * 3)} height={chartHeight}>
          {/* Background grid */}
          <Line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#e0e0e0" strokeWidth={1} />
          <Line x1={padding} y1={chartHeight/2} x2={chartWidth - padding} y2={chartHeight/2} stroke="#e0e0e0" strokeWidth={1} />
          <Line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#e0e0e0" strokeWidth={1} />
          
          {/* Price line */}
          {pricePath && (
            <Path d={pricePath} stroke="#2196F3" strokeWidth={2} fill="none" />
          )}
          
          {/* SMA20 line */}
          {sma20Path && (
            <Path d={sma20Path} stroke="#FF9800" strokeWidth={1.5} fill="none" strokeDasharray="5,5" />
          )}
          
          {/* SMA50 line */}
          {sma50Path && (
            <Path d={sma50Path} stroke="#9C27B0" strokeWidth={1.5} fill="none" strokeDasharray="5,5" />
          )}
          
          {/* Buy signals */}
          {buyTrades.map((trade, index) => (
            <Circle
              key={`buy-${index}`}
              cx={getX(trade.x)}
              cy={getY(trade.y)}
              r={4}
              fill="#4CAF50"
              stroke="#fff"
              strokeWidth={2}
            />
          ))}
          
          {/* Sell signals */}
          {sellTrades.map((trade, index) => (
            <Circle
              key={`sell-${index}`}
              cx={getX(trade.x)}
              cy={getY(trade.y)}
              r={4}
              fill="#F44336"
              stroke="#fff"
              strokeWidth={2}
            />
          ))}
          
          {/* Y-axis labels */}
          {priceRange > 0 && (
            <>
              <SvgText x={padding - 10} y={padding + 5} fontSize="10" fill="#666" textAnchor="end">
                ${maxPrice.toFixed(2)}
              </SvgText>
              <SvgText x={padding - 10} y={chartHeight/2 + 3} fontSize="10" fill="#666" textAnchor="end">
                ${((maxPrice + minPrice) / 2).toFixed(2)}
              </SvgText>
              <SvgText x={padding - 10} y={chartHeight - padding + 3} fontSize="10" fill="#666" textAnchor="end">
                ${minPrice.toFixed(2)}
              </SvgText>
            </>
          )}
        </Svg>
      </ScrollView>

      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.legendText}>Price</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.legendText}>SMA20</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#9C27B0' }]} />
            <Text style={styles.legendText}>SMA50</Text>
          </View>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>Buy</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
            <Text style={styles.legendText}>Sell</Text>
          </View>
        </View>
      </View>

      <View style={styles.tradesSummary}>
        <Text style={styles.summaryTitle}>Trades Analysis</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Total Signals: {trades.length}</Text>
          <Text style={styles.summaryText}>Buy: {buyTrades.length}</Text>
          <Text style={styles.summaryText}>Sell: {sellTrades.length}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 8,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performanceText: {
    fontSize: 12,
    color: '#666',
  },
  chartContainer: {
    marginBottom: 16,
  },
  legend: {
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#666',
  },
  tradesSummary: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryText: {
    fontSize: 12,
    color: '#666',
  },
});

export default StrategyChart;
