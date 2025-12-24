// Simple test script to verify the customer search functionality
const fetch = require('node-fetch');

async function testCustomerSearch() {
  try {
    console.log('Testing customer search endpoint...');
    
    // Test with a phone number that doesn't exist
    const response1 = await fetch('http://localhost:3000/api/customers/search?phone=1234567890', {
      headers: {
        'Authorization': 'Bearer test-token' // Replace with a valid token if needed
      }
    });
    
    const data1 = await response1.json();
    console.log('Test 1 - Non-existent phone:', data1);
    
    // Test with a phone number that exists (if you have one in your database)
    // const response2 = await fetch('http://localhost:3000/api/customers/search?phone=9876543210', {
    //   headers: {
    //     'Authorization': 'Bearer test-token'
    //   }
    // });
    // 
    // const data2 = await response2.json();
    // console.log('Test 2 - Existing phone:', data2);
    
  } catch (error) {
    console.error('Error testing customer search:', error);
  }
}

// Uncomment to run the test
// testCustomerSearch();

console.log('Test script created. Uncomment the testCustomerSearch() call to run the test.');