import { vectorFluxService } from './vectorFluxService';

/**
 * Hook para integración con VectorFlux AI Core
 * Permite obtener predicciones y entrenar modelos DNN/LSTM para activos seleccionados
 */
import { useState, useCallback } from 'react';

export function useVectorFluxAI() {
  const [loading, setLoading] = useState(false);
  const [training, setTraining] = useState({}); // { [modelType]: boolean }
  const [predictions, setPredictions] = useState({}); // { [symbol]: { dnn, lstm, ... } }
  const [error, setError] = useState(null);

  // Inicializar VectorFlux AI Core
  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await vectorFluxService.initialize();
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtener predicciones DNN y LSTM para una lista de activos
  const getPredictions = useCallback(async (symbols = []) => {
    setLoading(true);
    setError(null);
    try {
      const results: any = {};
      for (const symbol of symbols) {
        // Llama al análisis completo (puedes optimizar para solo predicción si lo deseas)
        const analysis = await (vectorFluxService as any).performCompleteAnalysis(symbol);
        const aiPred: any = analysis?.aiAnalysis?.aiPrediction;
        // Robustez: busca DNN/LSTM en individual y raíz
        let dnn = null, lstm = null;
        if (aiPred?.individual) {
          dnn = aiPred.individual.dnn ?? null;
          lstm = aiPred.individual.lstm ?? null;
        }
        if (dnn == null && aiPred?.dnn !== undefined) dnn = aiPred.dnn;
        if (lstm == null && aiPred?.lstm !== undefined) lstm = aiPred.lstm;
        results[symbol] = {
          dnn,
          lstm,
          confidence: analysis?.overallConfidence || null,
          price: analysis?.currentPrice || null,
          change24h: analysis?.priceChange24h || null
        };
      }
      setPredictions(results);
      return results;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Entrenar modelo DNN o LSTM para un activo
  const trainModel = useCallback(async (modelType, symbol) => {
    setTraining(prev => ({ ...prev, [modelType]: true }));
    setError(null);
    try {
      // Llama al método de entrenamiento del servicio singleton
      if (typeof (vectorFluxService).trainModel === 'function') {
        await (vectorFluxService).trainModel(modelType, symbol);
      } else {
        // Simulación: espera 2s
        await new Promise(res => setTimeout(res, 2000));
      }
    } catch (e) {
      setError(e);
    } finally {
      setTraining(prev => ({ ...prev, [modelType]: false }));
    }
  }, []);

  return {
    initialize,
    getPredictions,
    trainModel,
    loading,
    training,
    predictions,
    error
  };
}
