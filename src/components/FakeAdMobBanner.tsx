import React from 'react';
import { View, Image } from 'react-native';
import { StyleSheet } from 'react-native';

const FakeBanner = () => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/WholeFoods.png')}
        style={styles.banner}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 100,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    width: 200,
    height: 50,
    resizeMode: 'contain',
  },
});

export default FakeBanner;
