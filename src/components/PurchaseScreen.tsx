import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, Platform } from 'react-native';
import * as RNIap from 'react-native-iap';
import type { Product } from 'react-native-iap';

const productIds =
  Platform.select({
    ios: ['your_ios_product_id'],
    android: ['your_android_product_id'],
  }) || [];

export default function PurchaseScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    RNIap.initConnection().then(async () => {
      try {
        const items = await RNIap.getProducts({ skus: productIds });
        setProducts(items);
      } catch (err) {
        Alert.alert('Error', 'Failed to load products');
      } finally {
        setLoading(false);
      }
    });
    return () => {
      RNIap.endConnection();
    };
  }, []);

  const buy = async (sku: string) => {
    try {
      await RNIap.requestPurchase({ sku });
      Alert.alert('Success', 'Purchase successful!');
    } catch (err) {
      Alert.alert('Error', 'Purchase failed');
    }
  };

  if (loading) return <Text>Loading...</Text>;

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>In-App Purchases</Text>
      {products.map((prod) => (
        <View key={prod.productId} style={{ margin: 10 }}>
          <Text>
            {prod.title} - {prod.localizedPrice}
          </Text>
          <Button title="Buy" onPress={() => buy(prod.productId)} />
        </View>
      ))}
    </View>
  );
}
