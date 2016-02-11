import React, { Component, PropTypes } from 'react'
import { Link } from 'react-router'
import { Person } from 'blockchain-profile'

import Image from './Image'
import { getName, getSocialAccounts, getAvatarUrl } from '../utils/profile-utils.js'

class SearchItem extends Component {
  static propTypes = {
    profile: PropTypes.object.isRequired,
    id: PropTypes.string.isRequired
  }

  constructor(props) {
    super(props)
    this.state = {}
  }

  render() {
    const profile = Person.fromLegacyFormat(this.props.profile).profile,
          name = getName(profile),
          avatarUrl = getAvatarUrl(profile),
          accounts = getSocialAccounts(profile),
          blockchainId = this.props.id

    return (
      <Link to={`/profile/blockchain/${blockchainId}`} className="list-group-item search-result p-l-11 m-b-11">
          <div className="col-md-1">
            <Image className="result-img" src={avatarUrl} id={blockchainId}
              fallbackSrc="https://s3.amazonaws.com/65m/avatar-placeholder.png" />
          </div>
          <div className="col-md-3">{name}</div>
          <div className="col-md-2">{blockchainId}</div>
          <div className="col-md-6">
            {accounts.map((account, index) => {
              return (
                <span key={index}>
                  <span>{account.service} : {account.identifier}</span>
                  { index !== accounts.length - 1 ?
                  <span>&nbsp;/&nbsp;</span>
                  : null }
                </span>
              )
            })}
          </div>
      </Link>
    )
  }
}

export default SearchItem