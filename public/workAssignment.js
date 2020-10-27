window.addEventListener('DOMContentLoaded', () => {
  const responseDiv = document.getElementById('response')
  const savedCopyCheckbox = document.querySelector('#savedcopy > input')
  const buttonDiv = document.createElement('div')
  const iframePid = new Map()

  function hash(s) {
    let r = 0
    for (let i = 0; i < s.length; i++) r = (31 * r + s.charCodeAt(i)) % 4294967296 // 2 ** 32
    if (r >= 4294967296 / 2) r = r - 4294967296  
    return r      
  }
  
  function problemPid(problem) {
    return problem.qid !== undefined ? problem.qid : problem.URL
  }
  
  function score(problems, work) {
    let score = 0
    for (const qid in work.problems) {
      const submissionPid = 'pid' in work.problems[qid] ? work.problems[qid].pid : qid
      for (const p of problems)
        if (problemPid(p) === submissionPid) 
          score += work.problems[qid].score * p.weight
    }
    return score
  }

  function sendingIframe(event) {
    for (const f of document.getElementsByClassName('exercise-iframe'))
      if (f.contentWindow === event.source) return f
    return undefined
  }

  function updateScore(e, score) {
    const text = e.textContent
    let index = text.indexOf(' (')
    if (index < 0) index = text.length
    e.textContent = text.substring(0, index) + ' (' + percent(score) + ')'
  }

  function updateScoreDisplay(workKey) {
    const score = work.problems[workKey].score
    const button = document.getElementById('button-' + workKey)
    updateScore(button, score)
  }
  
  function adjustDocHeight(iframe, request) {
    const newHeight = request.param.docHeight;
    if (iframe.height < newHeight)
      iframe.style.height = newHeight + 'px'
  }

  function restoreStateOfProblem(iframe, request) {
    let qid = request.param.qid
    if (qid === undefined) qid = iframePid.get(iframe)
    if (qid in work.problems) {
      iframe.contentWindow.postMessage({ request, param: work.problems[qid].state }, '*');
      updateScoreDisplay(workKey);
    } else {
      iframe.contentWindow.postMessage({ request, param: null }, '*')
      console.log('No work for problem with qid ' + qid)
    }
  }

  async function sendScoreAndState(iframe, request) {    
    if (!assignment.isStudent) return // Viewing as instructor
    let qid = request.param.qid
    let pid = iframePid.get(iframe)  
    if (qid === undefined) qid = pid
    work.problems[qid] = request.param
    if (qid != pid) work.problems[qid].pid = pid
    updateScoreDisplay(workKey);     
    try {
      responseDiv.textContent = ''
      work.submittedAt = new Date(Date.now() - assignment.receivedAt + Date.parse(assignment.sentAt)).toISOString()
      if (lti !== undefined) {
        lti.work = work
        let result = await postData("/lti/saveWork", lti)
        updateScore(document.querySelector('h1'), result.score)
      } else {
        await postData("/saveWork", work)
        updateScore(document.querySelector('h1'), score(problems, work))
      }
    } catch (e) {
      responseDiv.textContent = `Error: ${e.message}` 
    }  
  }
    
  function activateButtons() {
    savedCopyCheckbox.checked = true 
    for (const btn of buttonDiv.children) {
      btn.classList.remove('hc-disabled')
    }
    buttonDiv.children[0].classList.add('active')
    const iframeID = buttonDiv.children[0].id.replace('button', 'problem')       
    document.getElementById(iframeID).style.display = 'block'                   
  }
  
  assignment.receivedAt = Date.now()  
  const problems = assignment.problems[hash(studentID) % assignment.problems.length]  
  
  window.addEventListener("message", event => {
    let iframe = sendingIframe(event)
    if (event.data.query === 'docHeight') 
      adjustDocHeight(iframe, event.data)
    else if (event.data.query === 'retrieve') 
      restoreStateOfProblem(iframe, event.data)      
    else if (event.data.query === 'send') 
      sendScoreAndState(iframe, event.data)
  }, false);
  
  document.getElementById('switchID').appendChild(createButton('hc-command', 'Switch to this ID', () => {
      responseDiv.textContent = ''
      const newccid =  document.getElementById('newccid').value
      if (/^(([aeiouy][bcdfghjklmnpqrstvwxz]){2}|([bcdfghjklmnpqrstvwxz][aeiouy]){2})(-(([aeiouy][bcdfghjklmnpqrstvwxz]){2}|([bcdfghjklmnpqrstvwxz][aeiouy]){2})){3}$/.test(newccid)) {
        location = `${location.href.split(/[?#]/)[0]}?newid=${newccid}`                
      } else {
        responseDiv.textContent = 'Not a valid CodeCheck ID'
      }        
    }))
  document.getElementById('clearID').appendChild(createButton('hc-command', 'Clear ID now', () => {
      location = `${location.href.split(/[?#]/)[0]}?newid=`    
    }))
      
  buttonDiv.id = 'buttons'
  document.body.appendChild(buttonDiv)
  
    /*  TODO when inside LTI
        <p>
            When you are done, click <button onclick="submitGrades()">Record my score</button> to save your score in the gradebook.
        </p>
        
        If instructor, add link to view/maybe edit
    */        

  let allWeightsSame = true
  for (let i = 1; allWeightsSame && i < problems.length; i++) 
    allWeightsSame = Math.abs(problems[0].weight - problems[i].weight) < 0.001   

  for (let i = 0; i < problems.length; i++) {
    const iframe = document.createElement('iframe')    
    iframePid.set(iframe, problemPid(problems[i]))
    iframe.className = 'exercise-iframe'
    iframe.src = problems[i].URL 
    document.body.appendChild(iframe)
    iframe.style.display = 'none'
    const action = () => {
      if (!savedCopyCheckbox.checked) return
      for (const f of document.getElementsByClassName('exercise-iframe'))
        if (f !== iframe) f.style.display = 'none'
      iframe.style.display = 'block'
      for (const btn of buttonDiv.children)
        if (btn !== button)
          btn.classList.remove('active')
      button.classList.add('active')  
    }    

    const button = createButton('hc-step', '' + (i + 1), action)
    button.classList.add('hc-disabled')
    button.id = 'button-' + workKey
    buttonDiv.appendChild(button)
    button.textContent = "" + (i + 1)
    if (!allWeightsSame) button.title = `Weight: ${percent(problems[i].weight)}` 
  }
  
  if (assignment.isStudent) {
    updateScore(document.querySelector('h1'), score(problems, work))  
    if (lti === undefined) {
      document.getElementById('returnToWorkURL').textContent = assignment.returnToWorkURL
    
      document.getElementById('returnToWork').appendChild(createButton('hc-command', 'Copy', () => { 
        window.getSelection().selectAllChildren(returnToWorkURLSpan) 
        document.execCommand('copy')
        window.getSelection().removeAllRanges() 
      }))
      
      if (assignment.editKeySaved) {
        activateButtons()
        document.getElementById('savedcopy').style.display = 'none'
      } else {  
        savedCopyCheckbox.checked = false
      }      
    } else {
      activateButtons()
      document.getElementById('studentInstructions').style.display = 'none'
    }       
    document.getElementById('instructorInstructions').style.display = 'none'
  } else { // Instructor view
    if ('cloneURL' in assignment) 
      document.getElementById('abovebuttons').appendChild(createButton('hc-command', 'Clone', () => {
        window.open(assignment.cloneURL, '_blank')        
      }))
    if ('viewSubmissionsURL' in assignment) 
      document.getElementById('viewSubmissions').appendChild(createButton('hc-command', 'View submissions', () => {
          window.open(assignment.viewSubmissionsURL, '_blank')        
        }))    
    activateButtons()
    document.getElementById('studentInstructions').style.display = 'none'
  }
    
  savedCopyCheckbox.addEventListener('change', () => {    
    if (savedCopyCheckbox.checked) {
      activateButtons()
    } else {
      for (const btn of buttonDiv.children) {
        btn.classList.add('hc-disabled')
        btn.classList.remove('active')
      }
      for (const f of document.getElementsByClassName('exercise-iframe'))
        f.style.display = 'none'
    }
  })  
})