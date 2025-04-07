  // 1 SOL = 1,000,000,000 lamports

  import {
    Connection,
    Keypair,
    SystemProgram,
    LAMPORTS_PER_SOL,
    Transaction,
    sendAndConfirmTransaction,
    PublicKey,
  } from "@solana/web3.js";
  const webPush = await import('web-push');



  import bs58 from "bs58";
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const getConfirmation = async (connection, tx) => {
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
  const result = await getConfirmation(
    connection,
    "5kU3hcSEncTnGC4j5eE3pdLkEwgLiH7DFvgMAu8WEVQCH1Vj3EhRhK1w1AYqte73pDEuXmVmvQwgQdiVph2MNLay"
  );
  console.log(result);

  const parseTransaction = async (hash) => {
    try {
      const url = `https://api-devnet.helius.xyz/v0/transactions/?api-key=653a0351-27c5-432b-a141-83a4f62b1243`;
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

  const _response = await parseTransaction(
    "5kU3hcSEncTnGC4j5eE3pdLkEwgLiH7DFvgMAu8WEVQCH1Vj3EhRhK1w1AYqte73pDEuXmVmvQwgQdiVph2MNLay"
  );
  console.log(_response);

  // Your private key (Base58 format copied from your wallet)
  const privateKeyBase58 =
    "2YJL2fjijvvMtkaGyyuKARBK31amx9NbPgWpUf5PZkZ7f2gSgSh6QBdhg754wpB5RUzm6rnGN6fEkG2A8kznPj9G"; // Replace with your actual private key

  // Convert Base58 private key to Uint8Array
  const secretKey = bs58.decode(privateKeyBase58);

  // Create a Keypair from the secretKey
  const senderWallet = Keypair.fromSecretKey(secretKey);

  const receiverWalletAddress = new PublicKey(
    "4bMqG9xHpdnxjivEstg9qanGqhdLpWPnVHmrq6g2Kj3Y"
  );

  const balance = await connection.getBalance(senderWallet.publicKey);
  const solBalance = balance / LAMPORTS_PER_SOL;
  console.log("Sender wallet balance  : ", solBalance);

  const lamportsToSend = 0.01 * LAMPORTS_PER_SOL;

  const transferTransaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: senderWallet.publicKey,
      toPubkey: receiverWalletAddress,
      lamports: lamportsToSend,
    })
  );

  const response = await sendAndConfirmTransaction(
    connection,
    transferTransaction,
    [senderWallet]
  );
  console.log("Transaction response: ", response);


  const keys = webPush.default.generateVAPIDKeys();
console.log("VAPID Public Key:", keys.publicKey);
console.log("VAPID Private Key:", keys.privateKey);
