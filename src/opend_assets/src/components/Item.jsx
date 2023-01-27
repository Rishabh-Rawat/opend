import React, { useEffect, useState } from "react";
import logo from "../../assets/logo.png";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../declarations/nft";
import { idlFactory as tokenIdlFactory } from "../../../declarations/token";
import { Principal } from "@dfinity/principal";
import Button from "./Button";
import { opend } from "../../../declarations/opend";
import { off } from "process";
import CURRENT_USER_ID from "../index";
import PriceLabel from "./PriceLabel";

function Item(props) {
  const id = props.id;
  const localHost = "http://localhost:8080/";
  const agent = new HttpAgent({ host: localHost });
  //remove the line below for live deployment
  agent.fetchRootKey();

  const [name, setName] = useState();
  const [owner, setOwner] = useState();
  const [image, setImage] = useState(logo);
  const [button, setButton] = useState();
  const [priceInput, setPriceInput] = useState();
  const [loaderHidden, setLoaderHidden] = useState(true);
  const [blur, setBlur] = useState();
  const [sellStatus, setSellStatus] = useState(false);
  const [priceLabel, setPriceLabel] = useState();
  const [shouldDisplay, setDisplay] = useState(true);

  let NFTActor;

  async function loadNFT() {
    NFTActor = await Actor.createActor(idlFactory, {
      agent,
      canisterId: id,
    });

    const name = await NFTActor.getName();
    const owner = await NFTActor.getOwner();
    const imageData = await NFTActor.getAsset();
    const imageContent = new Uint8Array(imageData);
    const image = URL.createObjectURL(
      new Blob([imageContent.buffer], { type: "image/png" })
    );

    setName(name);
    setOwner(owner.toText());
    setImage(image);

    if (props.role == "collection") {
      const isNFTListed = await opend.isListed(id);

      if (isNFTListed) {
        setOwner("OpenD");
        setBlur({ filter: "blur(4px)" });
        setSellStatus(true);
      } else {
        setButton(<Button handleClick={handleSell} text="Sell" />);
      }
    } else if (props.role == "discover") {
      const originalOwner = await opend.getOriginalOwner(id);
      const price = await opend.getPrice(id);
      setPriceLabel(<PriceLabel price={price.toString()} />);
      setOwner(originalOwner.toText());
      console.log(originalOwner);

      if (originalOwner.toText() != CURRENT_USER_ID.toText()) {
        setButton(<Button handleClick={handleBuy} text="Buy" />);
      }
    }
  }

  async function handleBuy() {
    console.log("buy triggered");
    setLoaderHidden(false);
    const tokenActor = await Actor.createActor(tokenIdlFactory, {
      agent,
      canisterId: Principal.fromText("w6ozc-gaaaa-aaaaa-aaarq-cai"),
    });

    const sellerId = await opend.getOriginalOwner(id);
    const itemPrice = await opend.getPrice(id);

    const result = await tokenActor.transfer(sellerId, itemPrice);

    if (result == "Success") {
      const transferResult = await opend.completePurchase(
        id,
        sellerId,
        CURRENT_USER_ID
      );
      console.log("Purchase Result : " + transferResult);
      setLoaderHidden(true);
      setDisplay(false);
    }
  }

  let price;
  function handleSell() {
    setPriceInput(
      <input
        placeholder="Price in CHAD"
        type="number"
        className="price-input"
        value={price}
        onChange={(e) => {
          price = e.target.value;
        }}
      />
    );

    setButton(<Button handleClick={sellItem} text="Confirm" />);
  }

  async function sellItem() {
    setBlur({ filter: "blur(4px)" });
    setLoaderHidden(false);
    const listingResult = await opend.listItem(id, Number(price));
    console.log(listingResult);

    if (listingResult == "Listed successfully") {
      const openDId = await opend.getOpenDCanisterId();
      const transferResult = await NFTActor.transferOwnership(openDId);
      console.log(transferResult);

      if (transferResult == "Ownership transferred successfully.") {
        setLoaderHidden(true);
        setButton();
        setPriceInput();
        setOwner("OpenD");
        setSellStatus(true);
      }
    }
  }

  useEffect(() => {
    loadNFT();
  }, []);

  return (
    <div
      style={{ display: shouldDisplay ? "inline" : "none" }}
      className="disGrid-item"
    >
      <div className="disPaper-root disCard-root makeStyles-root-17 disPaper-elevation1 disPaper-rounded">
        <img
          className="disCardMedia-root makeStyles-image-19 disCardMedia-media disCardMedia-img"
          src={image}
          style={blur}
        />
        <div className="lds-ellipsis" hidden={loaderHidden}>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
        <div className="disCardContent-root">
          {priceLabel}
          <h2 className="disTypography-root makeStyles-bodyText-24 disTypography-h5 disTypography-gutterBottom">
            {name}
            {sellStatus && <span className="purple-text"> Listed </span>}
          </h2>
          <p className="disTypography-root makeStyles-bodyText-24 disTypography-body2 disTypography-colorTextSecondary">
            Owner: {owner}
          </p>
          {priceInput}
          {button}
        </div>
      </div>
    </div>
  );
}

export default Item;
