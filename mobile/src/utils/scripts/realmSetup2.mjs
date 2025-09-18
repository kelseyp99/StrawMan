import Realm from 'realm';

const MySchema = {
  name: 'MyObject',
  properties: {
    name: 'string',
    age: 'int',
  },
};

const realm = new Realm({ schema: [MySchema] });

realm.write(() => {
  const myObject = realm.create('MyObject', {
    name: 'John Doe',
    age: 30,
  });
});