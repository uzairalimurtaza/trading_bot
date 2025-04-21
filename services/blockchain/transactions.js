export const getConfirmation = async (connection, tx) => {
  try {
    const result = await connection.getSignatureStatus(tx, {
      searchTransactionHistory: true,
    });
    // console.log(result);
    if (!(result.value.confirmationStatus == "finalized")) {
      console.log("Transaction not finalized");
      return false;
    }
    return true;
  } catch (error) {
    console.log("Error fetching tx status : ", error);
    return false;
  }
};

export const parseTransaction = async (hash) => {
  try {
    const url = process.env.FETCH_TX_DETAIL_URL;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transactions: [hash],
      }),
    });
    const data = await response.json();
    console.log(data[0].description);
    //save to db transaction record 
    return {
      success: true,
      from: data[0].nativeTransfers[0].fromUserAccount,
      to: data[0].nativeTransfers[0].toUserAccount,
      amount: data[0].nativeTransfers[0].amount,
    };
  } catch (error) {
    console.log("Error fetching transaction detail : ", error);
    return { success: false, error };
  }
};
